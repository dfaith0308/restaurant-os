'use client'

/** 모바일에서 카카오톡 전송 화면을 열고, 실패 시 클립보드에 복사합니다. */
export function shareTextViaKakao(text: string, onFallback?: (msg: string) => void) {
  if (typeof window === 'undefined') return

  const url = `kakaotalk://send?text=${encodeURIComponent(text)}`
  window.location.href = url

  window.setTimeout(() => {
    void navigator.clipboard
      .writeText(text)
      .then(() => onFallback?.('카카오톡이 열리지 않으면 대화창에 길게 눌러 붙여넣기 해 주세요.'))
      .catch(() => onFallback?.('주문 내용을 수동으로 카카오톡에 보내 주세요.'))
  }, 600)
}
