'use client'

import Link from 'next/link'
import { KAKAO_CHANNEL_URL } from '@/lib/constants'

export default function KakaoInputRequest() {
  return (
    <div
      style={{
        background: '#ffffff',
        borderRadius: 14,
        border: '1px solid #e5e7eb',
        boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
        padding: 20,
        marginBottom: 16,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <div
          style={{
            background: '#f0f7f3',
            borderRadius: 6,
            padding: '4px 10px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          <span style={{ fontSize: 12 }}>🔍</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: '#1f5d3a' }}>식자재 소싱 전문가</span>
        </div>
      </div>

      <p
        style={{
          fontSize: 17,
          fontWeight: 800,
          color: '#1a1a1a',
          margin: '0 0 8px',
          lineHeight: 1.4,
        }}
      >
        지금 구매하시는 식자재,
        <br />
        전문가가 직접 점검해드립니다
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 16 }}>
        {['지금 가격이 적정한지', '더 합리적인 거래처가 있는지', '원가 구조가 맞는지'].map((item) => (
          <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: '#1f5d3a', fontSize: 13, fontWeight: 700 }}>✓</span>
            <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{item}</p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <a
          href={KAKAO_CHANNEL_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 16,
            background: '#FEE500',
            borderRadius: 12,
            textDecoration: 'none',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -10,
              left: 16,
              background: '#E8701C',
              color: '#fff',
              fontSize: 11,
              fontWeight: 700,
              padding: '3px 10px',
              borderRadius: 20,
            }}
          >
            무료 점검
          </div>
          <div
            style={{
              width: 36,
              height: 36,
              background: 'rgba(0,0,0,0.08)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 20,
            }}
          >
            💬
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1a1a', margin: '0 0 2px' }}>
              전표 사진 카톡으로 보내기
            </p>
            <p style={{ fontSize: 12, color: '#3d3d3d', margin: 0 }}>
              전문가가 직접 확인 · 사진 즉시 영구삭제
            </p>
          </div>
          <span style={{ fontSize: 16, color: '#3d3d3d' }}>→</span>
        </a>

        <Link
          href="/settings/ingredients"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            background: '#f7f6f2',
            borderRadius: 12,
            textDecoration: 'none',
            border: '1px solid #e5e7eb',
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              background: '#f0f7f3',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              fontSize: 20,
            }}
          >
            ✏️
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', margin: '0 0 2px' }}>
              직접 입력하기
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>
              식자재 이름 · 가격 직접 등록
            </p>
          </div>
          <span style={{ fontSize: 16, color: '#9ca3af' }}>→</span>
        </Link>
      </div>
    </div>
  )
}
