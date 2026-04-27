'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { updateOrderStatus } from '@/actions/orders'

export default function OrderCompleteButton({
  tenantId,
  orderId,
  disabled,
}: {
  tenantId:  string
  orderId:   string
  disabled?: boolean
}) {
  const router = useRouter()
  const [isPending, startTr] = useTransition()

  function handleClick() {
    startTr(async () => {
      const res = await updateOrderStatus(tenantId, orderId, 'completed')
      if (res.success) router.refresh()
      else {
        // TODO: 디자인된 토스트/에러 UI로 교체
        alert(res.error ?? '상태 변경 실패')
      }
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={disabled || isPending}
      style={{
        width: '100%',
        padding: '14px 14px',
        borderRadius: 12,
        border: 'none',
        background: (disabled || isPending) ? '#d1d5db' : '#111827',
        color: '#fff',
        fontSize: 15,
        fontWeight: 800,
        cursor: (disabled || isPending) ? 'not-allowed' : 'pointer',
      }}
    >
      {isPending ? '처리 중...' : '납품 완료 처리'}
    </button>
  )
}

