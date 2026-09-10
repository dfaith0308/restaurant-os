'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { cancelBuyOrder } from '@/actions/buy'

/**
 * 주문 취소 영역.
 * 아직 결제 전(pending_payment)인 주문만 고객이 직접 취소할 수 있다.
 * 그 외 상태에서는 버튼을 숨기고 문의 안내만 노출한다.
 */
export default function BuyOrderCancelSection({
  orderId,
  status,
  paymentStatus,
}: {
  orderId: string
  status: string
  paymentStatus: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, start] = useTransition()

  const cancellable = status === 'pending_payment' && paymentStatus !== 'paid'
  const alreadyClosed = status === 'cancelled' || status === 'refunded'

  if (alreadyClosed) return null

  if (!cancellable) {
    return (
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: '14px 18px',
          marginBottom: 10,
        }}
      >
        <p style={{ fontSize: 13, color: '#6b7280', margin: 0, lineHeight: 1.6 }}>
          결제가 진행된 주문은 화면에서 바로 취소할 수 없습니다. 취소가 필요하시면 문의해 주세요.
        </p>
      </div>
    )
  }

  function handleCancel() {
    setError(null)
    start(async () => {
      const r = await cancelBuyOrder(orderId)
      if (!r.success) {
        setError(r.error ?? '주문 취소에 실패했습니다')
        return
      }
      setOpen(false)
      router.refresh()
    })
  }

  return (
    <>
      <div style={{ marginBottom: 10 }}>
        {error ? (
          <div
            style={{
              padding: '12px 14px',
              background: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: 10,
              fontSize: 13,
              color: '#b91c1c',
              marginBottom: 8,
            }}
          >
            {error}
          </div>
        ) : null}
        <button
          type="button"
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
          disabled={pending}
          style={{
            width: '100%',
            padding: '13px',
            background: '#fff',
            border: '1px solid #e5e7eb',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            color: '#b91c1c',
            cursor: pending ? 'wait' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          주문 취소
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="주문 취소 확인"
          onClick={() => {
            if (!pending) setOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 360,
              background: '#fff',
              borderRadius: 14,
              padding: '22px 20px 18px',
              boxSizing: 'border-box',
            }}
          >
            <p style={{ fontSize: 16, fontWeight: 700, color: '#1a1a1a', margin: '0 0 8px' }}>
              주문을 취소할까요?
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 20px', lineHeight: 1.6 }}>
              취소하면 되돌릴 수 없습니다. 같은 상품이 필요하시면 다시 주문해 주세요.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                style={{
                  flex: 1,
                  padding: '13px',
                  background: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  color: '#374151',
                  cursor: pending ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                닫기
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={pending}
                style={{
                  flex: 1,
                  padding: '13px',
                  background: '#b91c1c',
                  border: '1px solid #b91c1c',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#fff',
                  cursor: pending ? 'wait' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {pending ? '취소 중…' : '주문 취소'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
