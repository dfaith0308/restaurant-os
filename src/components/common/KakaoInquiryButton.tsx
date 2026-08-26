import { KAKAO_CHANNEL_URL } from '@/lib/constants'

/**
 * 고객센터 문의 버튼 — 기존 카카오 채널로 연결한다.
 * 새 연동 없이 lib/constants 의 KAKAO_CHANNEL_URL 을 그대로 재사용한다.
 */
export default function KakaoInquiryButton({
  title = '문의하기',
  desc,
}: {
  title?: string
  /** 버튼 아래 보조 설명. 주문 상세에서는 주문번호를 함께 안내한다 */
  desc?: string
}) {
  return (
    <a
      href={KAKAO_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '14px 16px',
        background: '#FEE500',
        borderRadius: 12,
        textDecoration: 'none',
      }}
    >
      <span
        style={{
          width: 32,
          height: 32,
          background: 'rgba(0,0,0,0.08)',
          borderRadius: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        aria-hidden
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 3.5c-4.7 0-8.5 2.98-8.5 6.65 0 2.35 1.57 4.41 3.93 5.58l-.9 3.3a.35.35 0 00.53.38l3.94-2.6c.33.03.66.05 1 .05 4.7 0 8.5-2.98 8.5-6.66 0-3.67-3.8-6.65-8.5-6.65z"
            fill="#3d3d3d"
          />
        </svg>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{ display: 'block', fontSize: 14, fontWeight: 800, color: '#1a1a1a', margin: 0 }}
        >
          {title}
        </span>
        {desc ? (
          <span style={{ display: 'block', fontSize: 12, color: '#3d3d3d', marginTop: 2 }}>
            {desc}
          </span>
        ) : null}
      </span>
      <span style={{ fontSize: 16, color: '#3d3d3d', flexShrink: 0 }} aria-hidden>
        →
      </span>
    </a>
  )
}
