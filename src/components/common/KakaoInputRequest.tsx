import { KAKAO_CHANNEL_URL } from '@/lib/constants'

interface Props {
  variant?: 'banner' | 'button' | 'small'
}

export default function KakaoInputRequest({ variant = 'banner' }: Props) {
  const url = KAKAO_CHANNEL_URL

  if (variant === 'button') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: '10px 16px',
          background: '#FEE500',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          color: '#1a1a1a',
          textDecoration: 'none',
        }}
      >
        💬 카카오톡으로 전표 보내기
      </a>
    )
  }

  if (variant === 'small') {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          background: '#FEE500',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        <span style={{ fontSize: 16 }}>💬</span>
        <div>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>
            전표 사진 보내기
          </p>
          <p style={{ fontSize: 11, color: '#3d3d3d', margin: 0 }}>
            입력 완료 후 사진 즉시 삭제
          </p>
        </div>
        <span style={{ fontSize: 12, color: '#3d3d3d', marginLeft: 'auto' }}>→</span>
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 20px',
        background: '#FEE500',
        borderRadius: 12,
        textDecoration: 'none',
        marginBottom: 16,
        textAlign: 'left',
      }}
    >
      <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ fontSize: 28 }}>💬</span>
        <div>
          <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', margin: '0 0 3px' }}>
            전표 사진 보내주시면 직접 입력해드립니다
          </p>
          <p style={{ fontSize: 12, color: '#3d3d3d', margin: 0 }}>
            카카오톡으로 사진 전송 → 24시간 내 입력 완료 · 사진 즉시 삭제
          </p>
        </div>
      </div>
      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1a1a', flexShrink: 0 }}>
        카톡 보내기 →
      </span>
    </a>
  )
}
